#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import Handlebars from 'handlebars';
import minimist from 'minimist';
import { fileURLToPath } from 'url';

function splitProperties(raw) {
  const result = [];
  let current = '';
  let depth = 0;

  for (let char of raw) {
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = minimist(process.argv.slice(2));

let config = null;

if (args.importConfig) {
  const configPath = path.resolve(args.importConfig);
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
    console.log('✅ Loaded config from', configPath);
  } else {
    console.error('❌ Config file not found at:', configPath);
    process.exit(1);
  }
}

let answers;
if (config) {
  answers = config;
} else {
  answers = {
    feature: args.feature || '',
    folder: args.folder || '',
    properties: args.properties || '',
    effects: args.effects !== false,
    selectors: args.selectors !== false,
    useEntity: args.useEntity !== false,
    generateTests: args.withTests !== false
  };

  const prompts = [];
  if (!answers.feature) prompts.push({ type: 'input', name: 'feature', message: 'Feature name (e.g., products):' });
  if (!answers.folder) prompts.push({ type: 'input', name: 'folder', message: 'Output path (e.g., src/app/state):' });
  if (!answers.properties) prompts.push({ type: 'input', name: 'properties', message: 'State properties (e.g., id:number,name:string):' });
  if (!args.effects) prompts.push({ type: 'confirm', name: 'effects', message: 'Generate effects?', default: true });
  if (!args.selectors) prompts.push({ type: 'confirm', name: 'selectors', message: 'Generate selectors?', default: true });
  if (!args.useEntity) prompts.push({ type: 'confirm', name: 'useEntity', message: 'Use Entity Adapter for reducer?', default: true });
  if (!args.withTests) prompts.push({ type: 'confirm', name: 'generateTests', message: 'Generate unit test files?', default: true });
  if (!args.withPagination) prompts.push({ type: 'confirm', name: 'withPagination', message: 'Include pagination support?', default: false });
  if (!args.withLoadOne) prompts.push({ type: 'confirm', name: 'withLoadOne', message: 'Include single-entity load?', default: false });

  const promptAnswers = await inquirer.prompt(prompts);
  answers = { ...answers, ...promptAnswers };
}

const feature = answers.feature.toLowerCase();
const className = feature.charAt(0).toUpperCase() + feature.slice(1);
const folderPath = path.join(process.cwd(), answers.folder, feature);

const props = splitProperties(answers.properties);

await fs.ensureDir(folderPath);

const context = {
  feature,
  className,
  featureKey: `${feature}FeatureKey`,
  reducerName: `${feature}Reducer`,
  properties: props.map(p => {
    const [namePart, ...typeParts] = p.split(':');
    const name = namePart.trim();
    const type = typeParts.join(':').trim();
    const isOptional = name.endsWith('?');
    return {
      name: isOptional ? name.slice(0, -1) + '?' : name,
      type
    };
  }),
  withPagination: answers.withPagination,
  withLoadOne: answers.withLoadOne
};

const reducerTemplateName = answers.useEntity ? 'reducer' : 'reducer.basic';
const templates = ['actions', reducerTemplateName, 'model'];
if (answers.selectors) templates.push('selectors');
if (answers.effects) templates.push('effects');

for (const name of templates) {
  const templateFile = `${name}.hbs`;
  const src = path.join(scriptDir, 'templates', templateFile);
  const dest = path.join(folderPath, `${feature}.${name.replace('.basic', '')}.ts`);
  const content = await fs.readFile(src, 'utf-8');
  const template = Handlebars.compile(content);
  await fs.writeFile(dest, template(context));
}

if (answers.generateTests) {
  const testTemplates = ['actions.spec', 'reducer.spec', 'effects.spec'];
  for (const name of testTemplates) {
    const src = path.join(scriptDir, 'templates', `${name}.hbs`);
    const dest = path.join(folderPath, `${feature}.${name.replace('.hbs', '')}`);
    const content = await fs.readFile(src, 'utf-8');
    const template = Handlebars.compile(content);
    await fs.writeFile(dest, template(context));
  }
}

if (args.exportConfig) {
  const exportPath = path.join(process.cwd(), `${feature}.config.json`);
  await fs.writeJson(exportPath, answers, { spaces: 2 });
  console.log('📝 Config exported to', exportPath);
}

const appConfigPath = path.join(process.cwd(), 'src/app/app.config.ts');
const relativeReducerImport = path.relative(path.dirname(appConfigPath), path.join(folderPath, `${feature}.reducer`)).replace(/\\/g, '/');

if (await fs.pathExists(appConfigPath)) {
  let configContent = await fs.readFile(appConfigPath, 'utf-8');
  const importLine = `import { ${context.featureKey}, ${context.reducerName} } from './${relativeReducerImport}';`;
  const effectImportPath = './' + relativeReducerImport.replace(/\.reducer$/, '.effects');
  const effectImportLine = `import * as ${feature}Effects from '${effectImportPath}';`;

  if (answers.effects && !configContent.includes(effectImportLine)) {
    configContent = effectImportLine + '\n' + configContent;
  }

  const effectClassName = `${className}Effects`;
  

  if (!configContent.includes(importLine)) {
    configContent = importLine + '\n' + configContent;
    if (answers.effects && !configContent.includes(effectImportLine)) {
      configContent = effectImportLine + '\n' + configContent;
    }
  }

  if (answers.effects && !configContent.includes(effectImportLine)) {
    configContent = effectImportLine + '\n' + configContent;
  }

  const providerBlockStart = configContent.indexOf("providers: [");
  if (providerBlockStart !== -1 && !configContent.includes(`provideState(${context.featureKey}`)) {
    const insertAfter = "provideStore(),";
      let newLine = '';
      if (answers.effects && !configContent.includes(`provideEffects(${feature}Effects`)) {
        newLine += `\n    provideEffects(${feature.toLowerCase()}Effects),`;
      }

    const insertIndex = configContent.indexOf(insertAfter, providerBlockStart);
    if (insertIndex !== -1) {
      let before = configContent.slice(0, insertIndex + insertAfter.length);
      let after = configContent.slice(insertIndex + insertAfter.length);
      let newLine = `\n    provideState(${context.featureKey}, ${context.reducerName}),`;
      if (answers.effects && !configContent.includes(`provideEffects(${effectClassName}`)) {
        newLine += `\n    provideEffects(${effectClassName}),`;
      }
      configContent = before + newLine + after;
      await fs.writeFile(appConfigPath, configContent, 'utf-8');
      console.log('✅ app.config.ts patched successfully.');
    } else {
      console.log('⚠️ Could not find "provideStore()," to insert after.');
    }
  } else {
    console.log('⚠️ Could not patch app.config.ts — either already patched or malformed.');
  }
} else {
  console.log('⚠️ app.config.ts not found at src/app/app.config.ts');
}

console.log(`✅ NgRx files for "${feature}" generated at ${folderPath}`);
