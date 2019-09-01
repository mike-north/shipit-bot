/**
 * Tagged template literal string for syntax-highlighted GraphQL queries
 *
 * @example
 *
 * gql`
 *    query {
 *      repository(owner: "mike-north") {
 *        node {
 *          name
 *        }
 *      }
 *    }
 * `;
 */
export function gql(strings: TemplateStringsArray, ...others: any[]): string {
  const out: string[] = [strings[0]];
  for (let i = 0; i < others.length; i++) {
    out.push(others[i], strings[i + 1]);
  }
  return out.join('');
}
