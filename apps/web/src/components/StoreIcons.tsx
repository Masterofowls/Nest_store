import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {children}
        </svg>
    );
}

export function GridIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <rect x="4" y="4" width="6" height="6" rx="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" />
            <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </IconFrame>
    );
}

export function SearchIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
        </IconFrame>
    );
}

export function BoxIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M4 8 12 4l8 4v8l-8 4-8-4Z" />
            <path d="m4 8 8 4 8-4M12 12v8" />
        </IconFrame>
    );
}

export function HeartIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
        </IconFrame>
    );
}

export function CartIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M3 4h2.5l2.2 11h10.6L20.5 7H7" />
            <circle cx="9" cy="19.5" r="1.2" />
            <circle cx="17" cy="19.5" r="1.2" />
        </IconFrame>
    );
}

export function UserIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <circle cx="12" cy="8.5" r="3.8" />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </IconFrame>
    );
}

export function HomeIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M4 10.5 12 4l8 6.5V20h-5v-5.5h-6V20H4Z" />
        </IconFrame>
    );
}

export function TruckIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7" />
            <circle cx="7" cy="17.5" r="1.6" />
            <circle cx="17.5" cy="17.5" r="1.6" />
        </IconFrame>
    );
}

export function ScaleIcon(props: IconProps) {
    return (
        <IconFrame {...props}>
            <path d="M12 4v16M7 20h10M5 7h14" />
            <path d="m5 7-2.5 6a2.7 2.7 0 0 0 5 0ZM19 7l-2.5 6a2.7 2.7 0 0 0 5 0Z" />
        </IconFrame>
    );
}

export function StarIcon(props: IconProps) {
    return (
        <IconFrame fill="currentColor" stroke="none" {...props}>
            <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" />
        </IconFrame>
    );
}
