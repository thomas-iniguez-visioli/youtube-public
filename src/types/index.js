export interface Video {
    id: string;
    title: string;
    url: string;
    duration: number;
}

export interface User {
    id: string;
    username: string;
    email: string;
}

export interface AppState {
    videos: Video[];
    currentUser: User | null;
    isLoading: boolean;
}