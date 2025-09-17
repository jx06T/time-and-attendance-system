import { useState, useRef, useEffect } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    className?: string;
}

interface CustomSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (selectedValue: string) => void;
    disabled?: boolean;
}

function BasicSelect({ options, value, onChange, disabled }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(option => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className="relative w-36" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full flex items-center justify-between bg-gray-700 border border-gray-600 rounded p-1.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span>{selectedOption?.label || '請選擇...'}</span>
                <svg className={`w-4 h-4 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-0.5 bg-gray-700 rounded-md shadow-lg ">
                    <ul className="space-y-0.5">
                        {options.map(option => (
                            <li
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`
                                    px-3 py-1.5 text-sm cursor-pointer
                                    ${value === option.value ? 'border-accent-li border-2 rounded text-white hover:bg-gray-700' : 'text-gray-200 hover:bg-gray-700 rounded'}
                                    ${option.className || ''}
                                `}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default BasicSelect;