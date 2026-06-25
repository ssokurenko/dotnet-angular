import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Heartbeat {
  status: string;
  message: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly heartbeat = signal<Heartbeat | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  checkHeartbeat(): void {
    this.loading.set(true);
    this.error.set(null);
    this.heartbeat.set(null);

    this.http.get<Heartbeat>('/api/heartbeat').subscribe({
      next: (response) => {
        this.heartbeat.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not reach the server.');
        this.loading.set(false);
      }
    });
  }
}
