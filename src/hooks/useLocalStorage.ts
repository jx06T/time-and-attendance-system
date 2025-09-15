import { useState, useEffect } from 'react';

// T 是一个泛型，代表我们想存储的数据类型 (e.g., string, object, etc.)
function useLocalStorage<T>(key: string, initialValue: T) {
  // 1. 从 localStorage 读取初始状态，或使用传入的 initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      // 如果 localStorage 中有值，就解析它；否则，返回初始值
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // 如果解析出错 (例如，存的不是有效的 JSON)，也返回初始值
      console.error(error);
      return initialValue;
    }
  });

  // 2. 创建一个 setValue 函数，它会同时更新 state 和 localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // 允许 value 是一个函数，以模仿 useState 的行为 (e.g., setCount(c => c + 1))
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // 更新 state
      setStoredValue(valueToStore);
      // 更新 localStorage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  
  // (可选) 监听 storage 事件，实现多标签页同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key) {
            try {
                setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
            } catch (error) {
                console.error(error);
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue] as const;
}

export default useLocalStorage;