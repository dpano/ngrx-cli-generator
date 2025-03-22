# NgRx CLI Generator 🧠⚡

A powerful CLI tool to generate NgRx feature files automatically for Angular applications — with support for:

✅ Entity Adapter  
✅ Full CRUD Actions & Effects  
✅ Selectors  
✅ Unit Test Files  
✅ JSON Config Import/Export  
✅ Automatic Store Wiring in `app.config.ts`  
✅ Command-line flags for advanced control

---

## 🚀 Installation

Clone or download this repo, then install the dependencies:

```bash
npm install
```

Optionally link the CLI globally:

```bash
npm link
```

Now you can run:

```bash
generate-ngrx
```

---

## 🧪 Example Usage

Generate a new `products` feature with Entity Adapter and unit tests:

```bash
generate-ngrx \
  --feature products \
  --folder src/app/store \
  --properties "id:number,name:string" \
  --useEntity \
  --withTests \
  --exportConfig
```

> ⚠️ Always wrap the `--properties` value in quotes to avoid issues with colons (especially on PowerShell).

---

## 🛠 Features

- 🔁 CRUD actions (`load`, `create`, `update`, `delete`)
- 🧱 Entity Adapter or plain array state
- 🧪 Generates `.spec.ts` files for actions, reducer, effects
- 🧠 Selector support via `adapter.getSelectors()` when using EntityState
- ⚙️ Automatically updates `app.config.ts` with `provideState(...)`
- 📁 Generates files in the specified folder of your Angular app
- 📦 JSON config import/export

---

## 🧾 JSON Config Support

Export your current feature setup:

```bash
generate-ngrx --exportConfig
```

Then reuse it later:

```bash
generate-ngrx --importConfig products.config.json
```

---

## 🔧 Available Flags

| Flag             | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `--feature`      | Feature name (e.g. `products`)                          |
| `--folder`       | Target output path (e.g. `src/app/store`)               |
| `--properties`   | Comma-separated state props (`"id:number,name:string"`) |
| `--useEntity`    | Use Entity Adapter in reducer                           |
| `--withTests`    | Generate test files                                     |
| `--effects`      | Include effects (default: true)                         |
| `--selectors`    | Include selectors (default: true)                       |
| `--exportConfig` | Save inputs to JSON                                     |
| `--importConfig` | Load config from JSON                                   |

---

## 🧩 Example Output

```
src/app/store/products/
├── products.actions.ts
├── products.reducer.ts
├── products.effects.ts
├── products.model.ts
├── products.selectors.ts
├── products.actions.spec.ts
├── products.reducer.spec.ts
├── products.effects.spec.ts
```

---

## ✅ Requirements

- Node.js ≥ v18
- Angular ≥ v15
- NgRx ≥ v15+

---

## 💡 Coming Soon

- [ ] Support for `createFeature()` (NgRx v16+)
- [ ] NgRx Data integration
- [ ] Angular schematic version
- [ ] Web-based UI generator

---

## 👨‍💻 Author

Built with ❤️ by Dimi

---

## 🛟 License

MIT
