import React from 'react';

interface NumericKeypadProps {
    onInput: (value: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onConfirm?: () => void;
}

function KeypadButton({ onClick, children, className = '' }: { onClick: () => void, children: React.ReactNode, className?: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                font-bold bg-gray-800 p-4 text-xl rounded-md 
                hover:bg-gray-700 text-accent-li 
                transition-colors duration-200
                ${className}
            `}
        >
            {children}
        </button>
    );
}

function NumericKeypad({ onInput, onDelete, onClear, onConfirm }: NumericKeypadProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div className="grid grid-cols-3 gap-3 w-full mx-auto">
            {keys.map(key =>
                <KeypadButton key={key} onClick={() => onInput(key)}>
                    {key}
                </KeypadButton>
            )}
            <KeypadButton
                onClick={onClear}
                className="border-red-500 text-red-400 !font-semibold"
            >
                清除
            </KeypadButton>
            <KeypadButton onClick={() => onInput('0')}>
                0
            </KeypadButton>
            <KeypadButton
                onClick={onConfirm || (() => { })}
                className="  !text-accent-li !font-semibold"
            >
                打卡
            </KeypadButton>
        </div>
    );
}

export default NumericKeypad;