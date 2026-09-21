/**
 * Assistant Page - Smart Chat Assistant UI
 * Production-Grade Media Assistant
 */

import { mediaAssistant } from '../services/assistant/MediaAssistant.js';
import { icon } from '../ui/icons.js';

export async function AssistantPage() {
 const container = document.createElement('div');
 container.className = 'assistant-page';
 container.innerHTML = `
    <div class="container" style="padding-top: var(--sp-6); padding-bottom: 100px; max-width: 900px;">
      <div style="text-align: center; margin-bottom: var(--sp-8);">
        <div style="font-size: 48px; margin-bottom: var(--sp-3);"></div>
        <h1 style="font-size: var(--text-3xl); font-weight: 700; margin-bottom: var(--sp-2);">مساعد zPopcorn الذكي</h1>
        <p style="color: var(--color-text-secondary);">اسألني عن مكتبتك، سجل المشاهدة، التوصيات، والإحصائيات</p>
      </div>

      <div id="chat-container" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); min-height: 400px; max-height: 600px; overflow-y: auto; padding: var(--sp-5); margin-bottom: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4);">
        <div class="assistant-message" style="display: flex; gap: var(--sp-3); align-items: flex-start;">
          <div style="width: 36px; height: 36px; background: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"></div>
          <div style="background: var(--color-surface); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-xl) 16px 16px 4px; max-width: 80%; line-height: 1.6;">
            <div style="font-weight: 500; margin-bottom: var(--sp-1);">مرحباً! أنا مساعد zPopcorn</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-secondary);">يمكنني مساعدتك في:</div>
            <ul style="font-size: var(--text-sm); color: var(--color-text-secondary); margin: var(--sp-2) 0; padding-right: var(--sp-4); list-style: disc;">
              <li>آخر فيلم شاهدته</li>
              <li>كم حلقة بقيت لي في مسلسل؟</li>
              <li>أعمال كريستوفر نولان الموجودة عندي</li>
              <li>أكثر الأنواع التي أشاهدها</li>
              <li>اقترح فيلم أكشن من 2024</li>
            </ul>
          </div>
        </div>
      </div>

      <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-3); display: flex; gap: var(--sp-3); align-items: flex-end; position: sticky; bottom: 20px;">
        <div style="flex: 1;">
          <textarea id="assistant-input" placeholder="اكتب سؤالك هنا... مثال: آخر فيلم شاهدته" style="width: 100%; min-height: 44px; max-height: 120px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-md); padding: var(--sp-3); font-family: inherit; font-size: var(--text-sm); color: var(--color-text-primary); resize: none; outline: none;"></textarea>
          <div style="display: flex; gap: var(--sp-2); margin-top: var(--sp-2); flex-wrap: wrap;">
            <button class="quick-query" data-query="آخر فيلم شاهدته" style="padding: var(--sp-2) var(--sp-3); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs); cursor: pointer; color: var(--color-text-secondary);">آخر فيلم شاهدته</button>
            <button class="quick-query" data-query="اقترح فيلم أكشن" style="padding: var(--sp-2) var(--sp-3); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs); cursor: pointer; color: var(--color-text-secondary);">اقترح فيلم أكشن</button>
            <button class="quick-query" data-query="أكثر الأنواع التي أشاهدها" style="padding: var(--sp-2) var(--sp-3); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs); cursor: pointer; color: var(--color-text-secondary);">إحصائياتي</button>
            <button class="quick-query" data-query="ابحث عن Interstellar" style="padding: var(--sp-2) var(--sp-3); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs); cursor: pointer; color: var(--color-text-secondary);">ابحث عن Interstellar</button>
          </div>
        </div>
        <button id="send-btn" class="btn btn-primary" style="height: 44px; padding: 0 var(--sp-5); flex-shrink: 0;">إرسال</button>
      </div>
    </div>
 `;

 const chatContainer = container.querySelector('#chat-container');
 const input = container.querySelector('#assistant-input');
 const sendBtn = container.querySelector('#send-btn');

 const addUserMessage = (text) => {
 const div = document.createElement('div');
 div.style.cssText = 'display: flex; gap: var(--sp-3); align-items: flex-start; justify-content: flex-end;';
 div.innerHTML = `
      <div style="background: var(--color-accent); color: var(--accent-contrast); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-xl) 16px 4px 16px; max-width: 80%; line-height: 1.6; font-size: var(--text-sm);">${text}</div>
      <div style="width: 36px; height: 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;color:var(--color-text-muted)">${icon('users', 18)}</div>
 `;
 chatContainer.appendChild(div);
 chatContainer.scrollTop = chatContainer.scrollHeight;
 };

 const addAssistantMessage = (response) => {
 const div = document.createElement('div');
 div.style.cssText = 'display: flex; gap: var(--sp-3); align-items: flex-start;';
    
 let content = `
      <div style="background: var(--color-surface); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-xl) 16px 16px 4px; max-width: 80%; line-height: 1.6;">
        <div style="font-size: var(--text-sm); white-space: pre-wrap;">${response.message || 'لا توجد إجابة'}</div>
 `;

 // Add data if available
 if (response.data && Array.isArray(response.data) && response.data.length > 0) {
 content += `<div style="margin-top: var(--sp-3); display: grid; gap: var(--sp-2);">`;
 response.data.slice(0, 3).forEach(item => {
 const title = item.title || item.name || item.mediaId || 'عنصر';
 content += `<div style="padding: var(--sp-2) var(--sp-3); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-md); font-size: var(--text-sm);">${title}</div>`;
 });
 content += `</div>`;
 }

 // Add actions
 if (response.actions && response.actions.length > 0) {
 content += `<div style="margin-top: var(--sp-3); display: flex; gap: var(--sp-2); flex-wrap: wrap;">`;
 response.actions.forEach(action => {
 content += `<button class="assistant-action" data-action='${JSON.stringify(action).replace(/'/g, "&#39;")}' style="padding: var(--sp-2) var(--sp-3); background: var(--color-accent); color: var(--accent-contrast); border: none; border-radius: var(--r-xl); font-size: var(--text-2xs); cursor: pointer;">${action.label}</button>`;
 });
 content += `</div>`;
 }

 content += `</div>`;
    
 div.innerHTML = `
      <div style="width: 36px; height: 36px; background: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"></div>
 ${content}
 `;

 chatContainer.appendChild(div);
 chatContainer.scrollTop = chatContainer.scrollHeight;

 // Bind action buttons
 div.querySelectorAll('.assistant-action').forEach(btn => {
 btn.addEventListener('click', () => {
 try {
 const action = JSON.parse(btn.dataset.action.replace(/&#39;/g, "'"));
 handleAction(action);
 } catch (e) {
 console.warn('Failed to parse action:', e);
 }
 });
 });
 };

 const handleAction = (action) => {
 switch (action.action) {
 case 'navigate':
 if (window.router) {
 window.router.navigate(action.path);
 } else {
 window.location.hash = `#${action.path}`;
 }
 break;
 case 'play':
 window.dispatchEvent(new CustomEvent('playmedia', { detail: { id: action.mediaId, media_type: action.mediaType } }));
 break;
 default:
 console.log('Unknown action:', action);
 }
 };

 const addTypingIndicator = () => {
 const div = document.createElement('div');
 div.id = 'typing-indicator';
 div.style.cssText = 'display: flex; gap: var(--sp-3); align-items: flex-start;';
 div.innerHTML = `
      <div style="width: 36px; height: 36px; background: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"></div>
      <div style="background: var(--color-surface); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-xl) 16px 16px 4px;">
        <div style="display: flex; gap: var(--sp-1);">
          <span style="width: 8px; height: 8px; background: var(--color-text-muted); border-radius: 50%; animation: bounce 1.4s infinite;"></span>
          <span style="width: 8px; height: 8px; background: var(--color-text-muted); border-radius: 50%; animation: bounce 1.4s infinite 0.2s;"></span>
          <span style="width: 8px; height: 8px; background: var(--color-text-muted); border-radius: 50%; animation: bounce 1.4s infinite 0.4s;"></span>
        </div>
      </div>
 `;
 chatContainer.appendChild(div);
 chatContainer.scrollTop = chatContainer.scrollHeight;
 return div;
 };

 const sendMessage = async () => {
 const query = input.value.trim();
 if (!query) return;

 addUserMessage(query);
 input.value = '';
 input.style.height = '44px';
    
 const typing = addTypingIndicator();
 sendBtn.disabled = true;
 sendBtn.textContent = '...';

 try {
 const result = await mediaAssistant.processQuery(query);
 typing.remove();
 addAssistantMessage(result.response);
 } catch (e) {
 typing.remove();
 addAssistantMessage({
 message: `عذراً، حدث خطأ: ${e.message}`,
 type: 'error'
 });
 }

 sendBtn.disabled = false;
 sendBtn.textContent = 'إرسال';
 };

 sendBtn.addEventListener('click', sendMessage);
  
 input.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 sendMessage();
 }
 });

 input.addEventListener('input', () => {
 input.style.height = '44px';
 input.style.height = Math.min(input.scrollHeight, 120) + 'px';
 });

 container.querySelectorAll('.quick-query').forEach(btn => {
 btn.addEventListener('click', () => {
 input.value = btn.dataset.query;
 sendMessage();
 });
 });

 return container;
}
