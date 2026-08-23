---
trigger: always_on
---

# Regra Mestra Aetherio: Protocolo Obrigatório de Pré-Implementação

Toda vez que o usuário solicitar qualquer modificação, adição, correção ou balanceamento no projeto:

1. **Abra e consulte sempre o arquivo [`aetherio.md`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/aetherio.md)** (ou a skill `aetherio` em [`.agents/skills/aetherio/SKILL.md`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/.agents/skills/aetherio/SKILL.md)).
2. **Siga rigorosamente as 6 Etapas do Protocolo de Pré-Implementação**:
   - Etapa 1: Mapeamento de Dependências e Arquivos Afetados
   - Etapa 2: Verificação das Invariantes do Jogo (Conservação de Recursos, Câmbio de Moeda, etc.)
   - Etapa 3: Auditoria Cruzada Macro (`CivilizationEngine.ts`) vs Micro (`EntityAI.ts`)
   - Etapa 4: Simulação Mental do Loop Temporal (10 e 200 anos)
   - Etapa 5: Redação do Plano com Diffs Exatos
   - Etapa 6: Execução Cirúrgica e Validação de Tipagem
3. **Consulte os Manuais de "Como Mexer no Jogo"** e as **Armadilhas Conhecidas** descritas no `aetherio.md` antes de propor alterações.
