import {
  all,
  choice,
  lazy,
  match,
  ok,
  Parser,
  text,
} from "https://raw.githubusercontent.com/wavebeem/bread-n-butter/v0.6.0/src/bread-n-butter.ts";

export interface NumberNode {
  type: "number";
  value: number;
}
export interface LiteralNode {
  type: "literal";
  value: string;
}
export interface VariableNode {
  type: "identifier";
  value: string;
}
export interface ExpressionNode {
  type: "expression";
  operator: string;
  left: Factor;
  right: Factor;
}

export type Factor =
  | NumberNode
  | LiteralNode
  | VariableNode
  | ExpressionNode
  | FunctionCallNode;

export interface AssignNode {
  type: "assign";
  variable: VariableNode;
  value: Factor | FunctionDefinitionNode;
}

export interface FunctionCallNode {
  type: "functionCall";
  name: string;
  arguments: (Factor | FunctionDefinitionNode)[];
  body?: Statement[];
}

export interface FunctionDefinitionNode {
  type: "functionDefinition";
  arguments: VariableNode[];
  body: Statement[];
}

export type AssignableNode = Factor | FunctionDefinitionNode;

export type Statement = AssignableNode | AssignNode;

/** optional whitespace */
const ows = match(/\s*/);
const optional = <A>(parser: Parser<A>) => parser.or(ok(undefined));
/** 前後の空白を許可する文字列 */
const token = <S extends string>(literal: S) => text(literal).trim(ows);
/** 前後の空白を許可する文字列 */
const tokenReg = (literal: RegExp) => match(literal).trim(ows);

/** for debug */
// deno-lint-ignore no-unused-vars
const debug = <A>(parser: Parser<A>) =>
  parser.map((d) => {
    console.log(d);
    return d;
  });

/** 識別子 */
const variable: Parser<VariableNode> = tokenReg(/[a-zA-Z][a-zA-Z0-9]*/).map((
  varibale,
) => ({
  type: "identifier",
  value: varibale,
} as const));

/** 数値 */
const number: Parser<NumberNode> = tokenReg(/[-+]?\d+(\.\d+)?/).map((d) => ({
  type: "number",
  value: parseFloat(d),
}));
const literal: Parser<LiteralNode> = tokenReg(/"[^"]*"|'[^']*'/).map((s) => ({
  type: "literal",
  value: s.slice(1, -1),
}));

const lParen = token("(");
const rParen = token(")");
const withParen = <A>(parser: Parser<A>) => parser.wrap(lParen, rParen);
const lBrace = token("{");
const rBrace = token("}");
const withBrace = <A>(parser: Parser<A>) => parser.wrap(lBrace, rBrace);
const comma = token(",");

const variableList = variable.sepBy(comma).thru(withParen);
const argumentList = lazy(() => expression.sepBy(comma).thru(withParen));

const functionDefinition: Parser<FunctionDefinitionNode> = lazy(() =>
  token("\\").next(variableList).and(
    program.thru(withBrace),
  ).map((
    [a, b],
  ) => ({
    type: "functionDefinition",
    arguments: a,
    body: b,
  } as const))
);

const functionCall: Parser<FunctionCallNode> = lazy(() =>
  all(variable, argumentList, program.thru(withBrace).thru(optional)).map((
    [a, b, c],
  ) => ({
    type: "functionCall",
    name: a.value,
    arguments: b,
    body: c,
  } as const))
);

const factor: Parser<Factor> = lazy(() =>
  choice(
    addExpression.thru(withParen),
    functionCall,
    number,
    literal,
    variable,
  )
);

const multiExpression: Parser<Factor> = factor.and(
  choice(token("*"), token("/"), token("%")).and(factor).repeat(),
)
  .map(([a, operands]) =>
    operands.reduce((left, [operator, right]) => ({
      type: "expression",
      operator,
      left,
      right,
    } as const), a)
  );

const addExpression: Parser<Factor> = multiExpression.and(
  token("+").or(token("-")).and(multiExpression).repeat(),
)
  .map(([a, operands]) =>
    operands.reduce((left, [operator, right]) => ({
      type: "expression",
      operator,
      left,
      right,
    } as const), a)
  );

const compareExpression: Parser<Factor> = choice(
  addExpression.skip(token("<")).and(addExpression).map((
    [left, right],
  ) => ({ type: "expression", operator: "<", left, right } as const)),
  addExpression.skip(token(">")).and(addExpression).map((
    [left, right],
  ) => ({ type: "expression", operator: ">", left, right } as const)),
  addExpression.skip(token("==")).and(addExpression).map((
    [left, right],
  ) => ({ type: "expression", operator: "==", left, right } as const)),
  addExpression.skip(token("!=")).and(addExpression).map((
    [left, right],
  ) => ({ type: "expression", operator: "!=", left, right } as const)),
);

const expression: Parser<AssignableNode> = choice(
  addExpression,
  compareExpression,
  functionDefinition,
);

const statement: Parser<Statement> = choice(
  variable.wrap(token("!"), token("=")).and(expression).map((
    [a, b],
  ) => ({ type: "assign", variable: a, value: b } as const)),
  expression,
);

const comment = match(/\/\/[^\r\n]*|/);
const line = statement.skip(token(";").thru(optional)).skip(comment);

const program = line.repeat();

export const parse = (text: string) => program.parse(text);
