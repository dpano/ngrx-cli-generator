#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import Handlebars from 'handlebars';
import minimist from 'minimist';
import { fileURLToPath } from 'url';

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

  const promptAnswers = await inquirer.prompt(prompts);
  answers = { ...answers, ...promptAnswers };
}

const feature = answers.feature.toLowerCase();
const className = feature.charAt(0).toUpperCase() + feature.slice(1);
const folderPath = path.join(process.cwd(), answers.folder, feature);
const props = answers.properties.split(',').map(p => p.trim()).filter(Boolean);

await fs.ensureDir(folderPath);

const context = {
  feature,
  className,
  featureKey: `${feature}FeatureKey`,
  reducerName: `${feature}Reducer`,
  properties: props.map(p => {
    const [name, type] = p.split(':');
    return { name, type };
  })
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

  if (!configContent.includes(importLine)) {
    configContent = importLine + '\n' + configContent;
  }

  const providersMatch = configContent.match(/providers\s*:\s*\[((.|\n)*?)\]/);
  if (providersMatch && !providersMatch[0].includes(`provideState(${context.featureKey}`)) {
    const patchedProviders = providersMatch[0].replace(
      /\[(.*?)\]/s,
      (match, content) =>
        `[${content.trim()},\n    provideState(${context.featureKey}, ${context.reducerName})]`
    );
    configContent = configContent.replace(providersMatch[0], patchedProviders);
    await fs.writeFile(appConfigPath, configContent, 'utf-8');
    console.log('✅ app.config.ts updated successfully.');
  } else {
    console.log('⚠️ Could not patch app.config.ts — either already patched or malformed.');
  }
} else {
  console.log('⚠️ app.config.ts not found at src/app/app.config.ts');
}

console.log(`✅ NgRx files for "${feature}" generated at ${folderPath}`);
