import { useState, useRef, useEffect } from 'react';

function CustomSelect({ value, onChange, options, placeholder = "請選擇..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // 過濾選項
    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 找到當前選中的選項
    const selectedOption = options.find(option => option.email === value);

    // 點擊外部關閉下拉選單
    useEffect(() => {
        const handleClickOutside = (event) => {
            // @ts-expect-error
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option.email);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className={`
          w-full p-3 h-13 bg-gray-800 border-2 rounded-lg cursor-pointer
          transition-all duration-200 hover:bg-gray-700
          ${isOpen ? 'border-accent-li ring-2 ring-blue-500/20' : 'border-gray-600 hover:border-gray-500'}
        `}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <span className={selectedOption ? 'text-white' : 'text-gray-400'}>
                        {selectedOption ? `${selectedOption.name} (${selectedOption.email})` : placeholder}
                    </span>
                    <svg
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-gray-800 border-2 border-gray-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                    {/* 搜尋框 */}
                    <div className="p-3 border-b border-gray-600">
                        <input
                            type="text"
                            placeholder="搜尋使用者..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* 選項列表 */}
                    <div className="max-h-80 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    className={`
                    p-3 cursor-pointer transition-colors duration-150
                    hover:bg-gray-700 flex items-center justify-between
                    ${value === option.email ? ' border-2 border-accent-li text-white' : 'text-gray-200'}
                  `}
                                    onClick={() => handleSelect(option)}
                                >
                                    <div>
                                        <div className="font-medium">{option.name}</div>
                                        <div className="text-sm text-gray-400">{option.email}</div>
                                    </div>
                                    {value === option.email && (
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-gray-400 text-center">無符合結果</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;