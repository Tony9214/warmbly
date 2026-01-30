import Turnstile from './Turnstile';
import React from 'react';

interface Props {
  visible: boolean;
  onToken: (t: string) => void;
}
export function TurnstileModal({ visible, onToken }: Props) {
    return (
        <div className={`fixed inset-0 flex bg-black/60 items-center justify-center ${visible ? "opacity-100 visible":"opacity-0 invisible"}`}>
            <Turnstile setToken={onToken} />
        </div>
    );
}