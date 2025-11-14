import React, { useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAppContext } from '../context/AppContext.tsx';

const ProfilePage: React.FC = () => {
    const { t } = useLanguage();
    const { user, avatarUrl, setAvatarUrl } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const newAvatarUrl = URL.createObjectURL(file);
            setAvatarUrl(newAvatarUrl);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const DetailField: React.FC<{ label: string, value: string | undefined }> = ({ label, value }) => (
        <div>
            <label className="text-xs text-muted-foreground">{label}</label>
            <div className="mt-1 p-3 w-full bg-secondary rounded-md border border-border text-foreground">
                {value || 'N/A'}
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-2xl mx-auto py-8 px-4 sm:px-6">
            <h1 className="text-3xl font-bold text-center mb-8 text-foreground">{t('profile')}</h1>
            <div className="space-y-8">
                {/* Profile Picture Card */}
                <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
                    <label className="text-sm font-medium text-muted-foreground">Profile Picture</label>
                    <div className="mt-4 flex flex-col items-center space-y-4">
                        <img src={avatarUrl} alt="Profile" className="h-32 w-32 rounded-full object-cover ring-4 ring-border" />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            accept="image/jpeg, image/png"
                            className="hidden"
                        />
                        <button
                            onClick={handleUploadClick}
                            className="bg-secondary hover:bg-border text-secondary-foreground font-semibold py-2 px-4 rounded-md transition-colors text-sm"
                        >
                            Upload new picture
                        </button>
                        <p className="text-xs text-muted-foreground">Recommended: 400x400px, JPG or PNG.</p>
                    </div>
                </div>

                {/* User Details Card */}
                <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
                    <label className="text-sm font-medium text-muted-foreground">User Details</label>
                    <div className="mt-4 space-y-4">
                        <DetailField label={t('full_name')} value={user?.name} />
                        <DetailField label={t('email_address')} value={user?.email} />
                        <DetailField label={t('role')} value={user?.role} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;