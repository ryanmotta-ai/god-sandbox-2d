# PLATFORM-V1B — Native Saves Hardening

## Implementado

- Recovery automático: se o save principal estiver ausente ou inválido, o runtime desktop busca o backup válido mais recente, restaura o slot e mantém o arquivo inválido em quarentena. O backend web mantém um backup por slot e aplica o mesmo recovery.
- Fila FIFO global por slot no frontend e mutex por slot no runtime Rust. Autosave (slot 0) e qualquer save manual destinado ao mesmo slot não podem escrever simultaneamente.
- Índice leve `save-index.json` no desktop, atualizado junto com cada escrita. A listagem usa apenas esse índice e metadados do arquivo; só reprocessa o documento completo quando ele for legado, alterado externamente ou o índice precisar ser reparado. O web storage usa `aethoria_save_index_v1`.
- Escrita fortalecida: arquivo temporário sincronizado e validado antes da promoção, preservação de até três backups desktop, rollback na falha de promoção e atualização indexada recuperável.
- Validação de envelope, versão, metadata e payload antes de importar/carregar. Versões incompatíveis, versões metadata/envelope divergentes e arquivos malformados são recusados.
- APIs de transferência `.aethoria`: `exportSlot` / `importSlot`, com comandos desktop equivalentes. Elas trabalham somente com o documento validado e nunca aceitam caminhos arbitrários; a escolha de arquivo continua responsabilidade da UI.
- Compatibilidade com `WebSaveStorage`, incluindo fallback de quota sem thumbnail e leitura de saves legados sem índice.

## Arquivos alterados

- `src/platform/saveFormat.ts`
- `src/platform/storage/SaveStorage.ts`
- `src/platform/storage/TauriSaveStorage.ts`
- `src/platform/storage/WebSaveStorage.ts`
- `src/core/SaveSystem.ts`
- `src-tauri/src/storage.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/permissions/save-storage.toml`
- `tests/platform-v1b.test.ts`
- `package.json`

## Resultado

- `npm run build`: PASS
- `npm run test:platform`: PASS
- Smoke test (salvar → sobrescrever → backup → fechar → abrir → carregar): PASS, executado pelo backend web em memória; confirmou recovery automático do backup e posterior leitura restaurada.
- Save/load: PASS
- Recovery: PASS

## Problemas restantes

- O ambiente atual não possui o executável Rust/Cargo no `PATH`; por isso a compilação e o smoke test do binário Tauri não puderam ser executados aqui. A cobertura TypeScript validou o contrato IPC, mas a verificação final do runtime Rust deve ser feita em uma máquina com o toolchain instalado.
- O seletor/salvador visual de arquivos não foi adicionado à UI: as APIs nativas de transferência retornam/aceitam o conteúdo `.aethoria` validado para que a camada de interface escolha o arquivo sem expor paths ao backend.
