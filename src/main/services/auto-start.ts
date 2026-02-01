import { app } from 'electron';

export class AutoStartManager {
  static enable(): void {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  static disable(): void {
    app.setLoginItemSettings({
      openAtLogin: false,
    });
  }

  static isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin;
  }

  static toggle(): boolean {
    const current = this.isEnabled();
    if (current) {
      this.disable();
    } else {
      this.enable();
    }
    return !current;
  }
}
