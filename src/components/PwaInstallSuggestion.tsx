import { usePwaInstall } from '../context/PwaInstallContext';

export default function PwaInstallSuggestion() {
  const { showSuggestion, isIos, openInstall, dismissSuggestion } = usePwaInstall();
  if (!showSuggestion) return null;

  return (
    <div className="mx-auto mt-8 max-w-md rounded-xl border border-accent-li/40 bg-gray-800/90 p-4 text-left shadow-lg">
      <div className="flex items-start gap-3">
        <img src="/web-app-manifest-192x192.png" alt="" className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">把打卡系統放到主畫面</p>
          <p className="mt-1 text-sm text-gray-300">下次可從主畫面直接開啟；打卡仍需網路連線。</p>
        </div>
        <button type="button" onClick={dismissSuggestion} aria-label="關閉安裝提示" className="px-1 text-xl leading-none text-gray-400 hover:text-white">×</button>
      </div>
      <button type="button" onClick={openInstall} className="mt-4 w-full rounded-lg border border-accent-li px-4 py-2 font-semibold text-accent-li hover:bg-accent/30">
        {isIos ? '查看加入主畫面步驟' : '安裝 App'}
      </button>
    </div>
  );
}
