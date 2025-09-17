import React, { useState, useRef, useEffect } from 'react';

interface CustomMonthPickerProps {
    value: string; // 'YYYY-MM'
    onChange: (newValue: string) => void;
}

const CustomMonthPicker: React.FC<CustomMonthPickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(() => parseInt(value.split('-')[0]));
    const [selectedMonth, setSelectedMonth] = useState(() => parseInt(value.split('-')[1]));

    const dropdownRef = useRef<HTMLDivElement>(null);

    const months = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

    useEffect(() => {
        const [year, month] = value.split('-').map(Number);
        setSelectedYear(year);
        setSelectedMonth(month);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleConfirm = () => {
        const formattedValue = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        onChange(formattedValue);
        setIsOpen(false);
    };

    const displayText = `${selectedYear}年 ${selectedMonth}月`;

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className={`
                    w-full h-13 p-3.5 bg-gray-800 border-2 rounded-lg cursor-pointer
                    transition-all duration-200 hover:bg-gray-700
                    ${isOpen ? 'border-accent-li ring-2 ring-accent/20' : 'border-gray-600'}
                `}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <span className="text-white text-sm">{displayText}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-600">
                        <div className="grid grid-cols-4 gap-1.5">
                            {years.map(year => (
                                <button
                                    key={year}
                                    className={`
                                        p-1 rounded text-xs transition-colors duration-150
                                        ${selectedYear === year ? 'border-2 border-accent-li text-white' : 'bg-gray-700 text-gray-300'}
                                    `}
                                    onClick={() => setSelectedYear(year)}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-2">
                        <div className="grid grid-cols-4 gap-1.5">
                            {months.map((month, index) => (
                                <button
                                    key={index}
                                    className={`
                                        p-1 rounded text-xs transition-colors duration-150
                                        ${selectedMonth === index + 1 ? ' border-2 border-accent-li text-white' : 'bg-gray-700 text-gray-300'}
                                    `}
                                    onClick={() => setSelectedMonth(index + 1)}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-2 border-t border-gray-600">
                        <button
                            className="w-full p-1.5 border-2 border-accent-li text-white rounded text-sm"
                            onClick={handleConfirm}
                        >
                            確認
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomMonthPicker;