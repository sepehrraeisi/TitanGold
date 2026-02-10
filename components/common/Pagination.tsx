import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalCount: number;
    limit: number;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    totalCount,
    limit
}) => {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);

    const getPageNumbers = () => {
        const pages = [];
        const buffer = 1;

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - buffer && i <= currentPage + buffer)
            ) {
                pages.push(i);
            } else if (
                i === currentPage - buffer - 1 ||
                i === currentPage + buffer + 1
            ) {
                pages.push('...');
            }
        }

        return pages.filter((v, i, a) => a.indexOf(v) === i);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-secondary/30 border-t border-border mt-4 rounded-b-lg">
            <div className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{startItem}</span> to <span className="font-medium text-foreground">{endItem}</span> of <span className="font-medium text-foreground">{totalCount}</span> results
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-medium rounded border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>

                <div className="flex items-center gap-1 mx-2">
                    {getPageNumbers().map((page, idx) => (
                        <React.Fragment key={idx}>
                            {page === '...' ? (
                                <span className="text-muted-foreground px-2">...</span>
                            ) : (
                                <button
                                    onClick={() => onPageChange(page as number)}
                                    className={`w-8 h-8 text-xs font-medium rounded transition-colors ${currentPage === page
                                            ? 'bg-purple-600 text-white'
                                            : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {page}
                                </button>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-medium rounded border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default Pagination;
