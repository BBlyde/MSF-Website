# MSF Leaderboard

Site web de la communauté **Minecraft Speedrun France (MSF)**, construit avec **React + Vite** et déployé sur **Vercel**.

**Live :** https://minecraftspeedrunfrance.fr

## Fonctionnalités

- **Classement Any%** — classement RSG des runners francophones
- **Classement Ranked** — classement MCSR Ranked par saison
- **MRM** — page dédiée au tournoi avec phase de groupes, bracket de phase finale et podium
- **Pronos MRM** — système de pronostics pour le MRM
- **Archives Tournois** — historique des tournois organisés par MSF

## Stack technique

- **Frontend :** React 18, React Router, Vite
- **Backend / API :** Serverless functions Vercel (`/api`), proxy vers un backend externe
- **Auth :** OAuth Discord (session cookie)
- **Analytics :** Vercel Analytics
- **Style :** CSS modules, Bootstrap Icons

## Développement local

```bash
npm install
npm run dev
```