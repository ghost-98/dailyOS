export function formatWon(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
