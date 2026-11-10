type SkeletonProps = {
    label: string;
    lines?: number;
};

export default function Skeleton({ label, lines = 3 }: SkeletonProps) {
    return (
        <output aria-busy="true" aria-label={`Loading ${label}`}>
            {Array.from({ length: lines }, (_, index) => (
                <span key={index} aria-hidden="true">
                    Loading {label}…
                </span>
            ))}
        </output>
    );
}
