# Aetherio / god-sandbox-2d

**Antes de ler ou editar qualquer arquivo deste repositório, invoque o skill
`aetherio`.** Ele é o mapa: onde cada coisa mora, como o tick flui, e quais
invariantes quebram sem dar erro de compilação. Ler o mapa custa uma fração do
que custa varrer 68 mil linhas às cegas — e evita editar no lugar errado.

Em qualquer tarefa de código, o skill `ponytail` também se aplica, em
intensidade full, travada para este projeto.

## As cinco leis (o resto está no skill)

1. **Tempo real.** Nada espera a virada do ano. Não existe pulso anual.
2. **Físico, não contábil.** Celeiro tem grão dentro; ouro é mercadoria na
   prateleira. Sem PIB, preço, imposto ou conta nacional — foram deletados.
3. **O glamour é visual.** Exército marchando, formação, cerco, batalha aérea.
4. **Política é gente.** Um rei com um traço, uma cidade com uma barra de
   lealdade. Sem facção social invisível.
5. **UI é clique, não tela.** Sem tela de planilha nova.

Militar é a exceção: **não se simplifica**, pode ganhar profundidade à vontade.

## Verificar

```bash
npx tsc --noEmit                       # sempre antes de commitar
npx tsx tests/<arquivo>.test.ts        # assert puro, sem framework
```
