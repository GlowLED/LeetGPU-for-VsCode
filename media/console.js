const vscode = acquireVsCodeApi();
const output = document.getElementById('output');
const state = document.getElementById('state');
const cancel = document.getElementById('cancel');
document.getElementById('clear').addEventListener('click', () => vscode.postMessage({ command: 'clear' }));
cancel.addEventListener('click', () => vscode.postMessage({ command: 'cancel' }));
window.addEventListener('message', ({ data }) => {
  if (data.type === 'clear') output.textContent = '';
  if (data.type === 'write') {
    for (const segment of data.segments || []) {
      const span = document.createElement('span');
      span.className = Array.isArray(segment.classes) ? segment.classes.join(' ') : '';
      span.textContent = segment.text;
      output.appendChild(span);
    }
    output.scrollTop = output.scrollHeight;
  }
  if (data.type === 'state') {
    state.textContent = data.label || (data.running ? 'Running…' : 'Ready');
    cancel.hidden = !data.running;
  }
});
