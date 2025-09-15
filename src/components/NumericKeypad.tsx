import React from 'react';

interface NumericKeypadProps {
    onInput: (value: string) => void;
    onDelete: () => void;
    onClear: () => void;
}

const KeypadButton: React.FC<{ onClick: () => void, children: React.ReactNode, className?: string }> = ({ onClick, children, className }) => (
    <button onClick={onClick} className={`border border-blue-400 p-4 text-xl rounded hover:bg-blue-700 ${className}`}>
        {children}
    </button>
);

const NumericKeypad: React.FC<NumericKeypadProps> = ({ onInput, onDelete, onClear }) => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto">
            {keys.map(key => <KeypadButton key={key} onClick={() => onInput(key)}>{key}</KeypadButton>)}
            <KeypadButton onClick={onClear} className="text-yellow-400">C</KeypadButton>
            <KeypadButton onClick={() => onInput('0')}>0</KeypadButton>
            <KeypadButton onClick={onDelete} className="text-red-400">DEL</KeypadButton>
        </div>
    );
};

export default NumericKeypad;