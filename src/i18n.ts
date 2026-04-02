import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "ALAE": "ALAE",
      "Global reasoning search...": "Global reasoning search...",
      "Models": "Models",
      "History": "History",
      "Plugins": "Plugins",
      "Settings": "Settings",
      "Theme": "Theme",
      "Language": "Language",
      "Search": "Search",
      "Explorer": "Explorer",
      "Conversations": "Conversations",
      "Main Architecture": "Main Architecture",
      "MCP Plugins": "MCP Plugins"
    }
  },
  zh: {
    translation: {
      "ALAE": "ALAE",
      "Global reasoning search...": "全局推导搜索...",
      "Models": "模型选择",
      "History": "历史记录",
      "Plugins": "插件扩展",
      "Settings": "系统设置",
      "Theme": "主题模式",
      "Language": "界面语言",
      "Search": "搜索",
      "Explorer": "资源管理",
      "Conversations": "会话面板",
      "Main Architecture": "主架构树",
      "MCP Plugins": "本地执行插件"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", 
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
