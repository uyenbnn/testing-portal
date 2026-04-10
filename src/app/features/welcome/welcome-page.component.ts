import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-welcome-page',
  imports: [RouterLink],
  template: `
    <main class="page">
      <section class="card hero">
        <p class="eyebrow">Testing Portal</p>
        <h1>Choose your role</h1>
        <p class="subtitle">No login required for MVP. You can go straight to the right workspace.</p>
      </section>

      <section class="grid">
        <article class="card role-card">
          <h2>Teacher</h2>
          <p>Create tests from plain text, set time limit, and publish with an auto-generated 6-digit code.</p>
          <a class="cta" routerLink="/teacher">Go to Teacher Workspace</a>
        </article>

        <article class="card role-card">
          <h2>Student</h2>
          <p>Join with a 6-digit code, enter your name and class, take the test, and view your result.</p>
          <a class="cta" routerLink="/student">Go to Student Workspace</a>
        </article>
      </section>
    </main>
  `,
  styles: `
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1rem 3rem;
      display: grid;
      gap: 1.25rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 1.25rem;
      box-shadow: 0 10px 30px rgba(8, 34, 44, 0.07);
    }

    .hero h1 {
      margin: 0.25rem 0;
      font-size: clamp(1.8rem, 4vw, 2.7rem);
      color: #102b33;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
      color: #13686a;
      margin: 0;
      font-size: 0.78rem;
    }

    .subtitle {
      margin: 0;
      color: #35545e;
      max-width: 55ch;
    }

    .grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .role-card h2 {
      margin-top: 0;
      margin-bottom: 0.5rem;
      font-size: 1.3rem;
      color: #0e3841;
    }

    .role-card p {
      margin: 0;
      color: #35545e;
      line-height: 1.5;
    }

    .cta {
      display: inline-block;
      margin-top: 1rem;
      text-decoration: none;
      color: #fff;
      background: linear-gradient(120deg, #0b7a7e 0%, #0f586f 100%);
      padding: 0.62rem 0.95rem;
      border-radius: 10px;
      font-weight: 700;
    }

    .cta:focus-visible,
    .cta:hover {
      outline: 2px solid #0f586f;
      outline-offset: 2px;
      filter: brightness(1.06);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomePageComponent {}
