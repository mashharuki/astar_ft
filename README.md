# Astar WASM token Contract

### Scripts

```json
"scripts": {
    "run-node": "swanky node start",
    "compile": "swanky contract compile psp22 -v",
    "test": "mocha -r ts-node/register \"test/**/*.test.ts\" --exit --timeout 20000",
    "test:static": "cd contracts/psp22 & cargo +nightly test",
    "postinstall": "patch-package"
}
```