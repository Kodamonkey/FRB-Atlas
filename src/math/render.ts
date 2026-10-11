import katex from 'katex';
import type { StageMath } from './model';

export function equationMarkup(stage: StageMath, active: string): string {
  const formula = stage.formula.replace(/@\{([a-z]+)\}/g, (_, id: string) => {
    const term = stage.terms.find(item => item.id === id);
    if (!term) throw new Error(`Unknown equation term: ${stage.id}/${id}`);
    return `\\htmlClass{equation-term term-${id}${active === id ? ' is-active' : ''}}{${term.symbol}}`;
  });
  return katex.renderToString(formula, { output: 'htmlAndMathml', throwOnError: true,
    strict: 'ignore', trust: context => context.command === '\\htmlClass', maxExpand: 100 });
}

export const symbolMarkup = (symbol: string) => katex.renderToString(symbol, { throwOnError: true, output: 'html', trust: false });

export function focusedEquationMarkup(stage: StageMath, active: string): string {
  // Keep the definition that explains this term readable; the complete system remains in sources.
  const clauses = stage.formula.replace(/\\(?:begin|end)\{aligned\}/g, '').replace(/&/g, '')
    .split(/\\\\|,\s*\\(?:qquad|quad)\s*/).map(clause => clause.trim().replace(/,$/, ''));
  const marker = `@{${active}}`;
  const formula = clauses.find(clause => clause.trim().startsWith(marker))
    ?? clauses.find(clause => clause.includes(marker)) ?? stage.formula;
  return equationMarkup({ ...stage, formula }, active);
}

export function termAtOperation(operation: number, count: number): number {
  const bounded = Number.isFinite(operation) ? Math.max(0, Math.min(1, operation)) : 0;
  return Math.max(0, Math.min(count - 1, Math.floor(bounded * count)));
}
