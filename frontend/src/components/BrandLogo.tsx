import React from 'react';

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'medium',
  variant = 'full',
  className = '',
}) => {
  const sizeClasses = {
    small: 'w-32 sm:w-36',
    medium: 'w-48 sm:w-56',
    large: 'w-64 sm:w-72',
    xlarge: 'w-80 sm:w-96',
  };

  const logoSrc = '/assets/reconcileai-logo.png';

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-xs border border-gray-200 dark:border-gray-800 p-1 ${className}`}>
        <img
          src={logoSrc}
          alt="ReconcileAI Logo Icon"
          className="w-8 h-8 object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={logoSrc}
        alt="ReconcileAI — AI Finance Controller"
        className={`${sizeClasses[size]} h-auto object-contain transition-all`}
      />
    </div>
  );
};
