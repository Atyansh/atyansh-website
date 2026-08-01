// Minimal DOM HUD for The Block: click-to-play gate, controls hint,
// door prompts. Deliberately sparse — the world is the UI (brief §1).

export class Hud {
  private root: HTMLDivElement;
  private prompt: HTMLDivElement;
  private gate: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;';

    this.gate = document.createElement('div');
    this.gate.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:12px;background:rgba(5,6,10,0.7);pointer-events:none;' +
      'transition:opacity .3s;text-align:center;';
    this.gate.innerHTML =
      '<div style="font-size:28px;font-weight:700;letter-spacing:.12em">THE BLOCK</div>' +
      '<div style="opacity:.75;font-size:14px">click to walk — WASD move · mouse look · shift run · esc release</div>';
    this.root.appendChild(this.gate);

    this.prompt = document.createElement('div');
    this.prompt.style.cssText =
      'position:absolute;left:50%;bottom:12%;transform:translateX(-50%);' +
      'padding:8px 16px;border-radius:8px;background:rgba(8,9,14,0.8);' +
      'border:1px solid rgba(255,255,255,0.25);font-size:14px;letter-spacing:.04em;' +
      'opacity:0;transition:opacity .15s;';
    this.root.appendChild(this.prompt);

    container.appendChild(this.root);
  }

  setLocked(locked: boolean): void {
    this.gate.style.opacity = locked ? '0' : '1';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  showDoorPrompt(name: string | null): void {
    if (name) {
      this.prompt.textContent = `⏎  enter ${name}`;
      this.prompt.style.opacity = '1';
    } else {
      this.prompt.style.opacity = '0';
    }
  }
}
