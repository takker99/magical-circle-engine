import {
  AssignableNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  Statement,
} from "./parse.ts";

interface Literal {
  type: "value";
  value: string | number | boolean;
}
type Evaluated = Literal | FunctionDefinitionNode;
type Stack = Map<string, Evaluated>;

/**
 * @param name
 * @param stacks 一番内側のscopeのstackから順に渡す
 * @returns
 */
const getVariable = (
  name: string,
  ...stacks: [Stack, ...Stack[]]
): Evaluated => {
  for (const stack of stacks) {
    const value = stack.get(name);
    if (value) return value;
  }
  throw TypeError(`Cannot use "${name}" before initialization.`);
};

const evaluate = <Node extends AssignableNode>(
  node: Node,
  ...stacks: [Stack, ...Stack[]]
): Evaluated | undefined => {
  switch (node.type) {
    case "number":
    case "literal":
      return { type: "value", value: node.value };
    case "identifier":
      return getVariable(node.value, ...stacks);
    case "expression":
      return { type: "value", value: calcExpression(node, ...stacks) };
    case "functionCall":
      return call(node, ...stacks);
    case "functionDefinition":
      return node;
  }
};

const assign = (
  name: string,
  value: AssignableNode,
  ...stacks: [Stack, ...Stack[]]
) => {
  const evaluated = evaluate(value, ...stacks);
  if (!evaluated) {
    throw TypeError(`Cannot assign undefined value to "${name}".`);
  }
  for (const stack of stacks) {
    if (!stack.has(name)) continue;
    stack.set(name, evaluated);
    return;
  }
  stacks[0].set(name, evaluated);
};

const call = (
  node: FunctionCallNode,
  ...stacks: [Stack, ...Stack[]]
): Evaluated | undefined => {
  const func = getVariable(node.name, ...stacks);
  if (func.type === "value") {
    throw TypeError(`"${node.name}" is not a function.`);
  }
  /** この関数のスコープだけで有効な変数を格納する領域 */
  const scope: Stack = new Map();

  // 引数を格納する
  if (func.arguments.length > node.arguments.length) {
    throw TypeError(`Too few arguments for "${node.name}".`);
  }
  for (let i = 0; i < node.arguments.length; i++) {
    const value = node.arguments[i];
    const name = func.arguments.at(i);
    if (name === undefined) {
      throw TypeError(`Too many arguments for "${node.name}".`);
    }
    assign(name, value, scope);
  }
  return execute(func.body, scope, ...stacks);
};

const calcExpression = (
  node: ExpressionNode,
  ...stacks: [Stack, ...Stack[]]
): number | string | boolean => {
  const l = evaluate(node.left, ...stacks);
  const r = evaluate(node.right, ...stacks);
  if (!l || !r) throw TypeError("Cannot calculate undefined values.");
  if (l.type !== "value" || r.type !== "value") {
    throw TypeError("Cannot calculate functions");
  }
  const left = l.value;
  const right = r.value;

  switch (node.operator) {
    case "*":
      if (typeof left !== "number" || typeof right !== "number") {
        throw TypeError("Cannot multiply non-number values.");
      }
      return left * right;
    case "/":
      if (typeof left !== "number" || typeof right !== "number") {
        throw TypeError("Cannot divide non-number values.");
      }
      return left / right;
    case "%":
      if (typeof left !== "number" || typeof right !== "number") {
        throw TypeError("Cannot calculate remainder of non-number values.");
      }
      return left % right;
    case "+":
      if (
        typeof left === "number" && typeof right === "number"
      ) {
        return left + right;
      }
      if (typeof left === "string" && typeof right === "string") {
        return left + right;
      }
      throw TypeError("Addition is only supported for numbers and strings.");
    case "-":
      if (typeof left !== "number" || typeof right !== "number") {
        throw TypeError("Cannot subtract non-number values.");
      }
      return left - right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
  }
};

const execute = (
  statements: Iterable<Statement>,
  ...stacks: [Stack, ...Stack[]]
): Evaluated | undefined => {
  let returnValue: Evaluated | undefined;
  for (const statement of statements) {
    if (statement.type === "assign") {
      assign(statement.variable, statement.value, ...stacks);
      continue;
    }
    returnValue = evaluate(statement, ...stacks);
  }
  return returnValue;
};

const execute0 = (statements: Iterable<Statement>): void => {
  execute(statements, new Map());
};

export { execute0 as execute };
