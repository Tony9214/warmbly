import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2">
          <span className="font-semibold">Warmbly</span>
        </div>
      ),
    },
    links: [
      {
        text: 'Dashboard',
        url: 'https://app.warmbly.com',
      },
    ],
  };
}
