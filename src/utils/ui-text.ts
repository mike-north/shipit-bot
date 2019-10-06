export function itemsWithCount(itemName: string, n: number): string {
  switch (n) {
    case 0:
      return `No ${itemName}s`;
    case 1:
      return `1 ${itemName}`;
    default:
      return `${n} ${itemName}s`;
  }
}

/**
 * Stringify a list of items, separating them with commas
 * and an "or" before the last item
 *
 * @param items items to serialize as a list
 *
 * @example
 *
 * listWithOr(["one", "two", "three"]);
 * "one, two or three"
 */
export function listWithOr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const rest = [...items];
  const last = rest.pop();
  return `${rest.join(', ')} or ${last}`;
}
