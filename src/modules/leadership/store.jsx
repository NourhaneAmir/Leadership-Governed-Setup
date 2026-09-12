/* =========================================================================
   The execution module's store.

   `Ctx` is provided once by App() in LeadershipApp.jsx; every screen reads it
   through `use()`. Both live here rather than in the app file so a screen can
   be moved into its own file — or into another module — and still reach the
   store by importing from a stable path instead of from a 10k-line sibling.

   The provider VALUE is still assembled in App(): it is built from that
   component's own state and effects, so it cannot move until those do. What
   this file fixes is the import direction — screens no longer have to be
   defined inside the same file as the context object.

   Shape of the value, for anyone writing a new screen:
     db, setDb, mut          the seeded record store and its mutator
     S, A                    governance settings, and the action creators
     me, bu, currentUser     who is acting, and in which Business Unit
     screen, go, sel, setSel navigation
     toast, toasts           notifications
     dv*                     live Dataverse arrays + refreshOccurrences()
   ========================================================================= */
import { createContext, useContext } from 'react';

export const Ctx = createContext(null);
export const use = () => useContext(Ctx);
