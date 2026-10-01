<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep mock product data in `src/lib/developers.ts` and shared client-only favorites in `app-context.tsx`, so replacing mocks later stays isolated.
- Meetings are not managed in the app: a company proposes one time and the developer gets it by e-mail, replying to the company directly. Keep the mocked send in `src/lib/api.ts` and the local history of sent proposals in shared client state and browser storage, because StackMatch remains a front-end-only prototype.
