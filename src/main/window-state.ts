let suppressWindowShow = false;

export function setSuppressWindowShow(value: boolean): void {
  suppressWindowShow = value;
  console.log(`[WindowState] suppressWindowShow=${value}`);
}

export function getSuppressWindowShow(): boolean {
  return suppressWindowShow;
}
