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
