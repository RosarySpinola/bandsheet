import { cn } from "@/lib/utils"

/**
 * Meteor Web and other web wallets open their tab from your tap. If the wallet takes too long to get ready, the browser
 * no longer counts the tap and Meteor shows "Continue in Meteor Web" instead of a tab. Its own button (or a second tap
 * here, which is faster) opens it.
 */
export function WebWalletTip({ className }: { className?: string }) {
  return (
    <span className={cn("text-[0.875rem] text-muted-foreground", className)}>
      Using Meteor Web? If Meteor says "Continue in Meteor Web" and no tab opens, press Open Meteor Web if Meteor shows that
      button; otherwise close Meteor's window and tap again (the second try is quicker). Nothing is signed until you approve.
    </span>
  )
}
