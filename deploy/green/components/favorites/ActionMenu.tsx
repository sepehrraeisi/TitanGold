import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { FavoriteItem } from '../../types.ts';

interface ActionMenuProps {
  item: FavoriteItem;
  onSetAlert: () => void;
  onTrade: () => void;
  onRemove: () => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ onSetAlert, onTrade, onRemove }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const menuItems = [
        { label: t('set_alert'), action: onSetAlert },
        { label: t('trade'), action: onTrade },
        { label: t('remove'), action: onRemove, isDestructive: true },
    ];

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="text-purple-400 hover:text-purple-300 p-1 rounded-full hover:bg-gray-700/50">
                 <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-[#2a2d42] border border-gray-700 rounded-md shadow-2xl z-50">
                    {menuItems.map(menuItem => (
                        <button
                            key={menuItem.label}
                            onClick={() => {
                                menuItem.action();
                                setIsOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                                menuItem.isDestructive 
                                    ? 'text-red-400 hover:bg-red-500/20' 
                                    : 'text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            {menuItem.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActionMenu;
