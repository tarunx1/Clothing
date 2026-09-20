import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HomepageContentEditor } from "@/components/admin/content/HomepageContentEditor";
import { LookbookManager } from "@/components/admin/content/LookbookManager";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPage } from "@/lib/admin/authorization";
import { getEditableContent, listLookbookForAdmin } from "@/lib/admin/services/contentAdmin";

export const metadata: Metadata = { title: "Content" };

export default async function AdminContentPage() {
  await requireAdminPage("content:write");
  const [content, lookbook] = await Promise.all([getEditableContent(), listLookbookForAdmin()]);
  return (
    <>
      <AdminHeader
        title="Homepage content"
        description="Words and images for the homepage’s fixed slots. Layout and animation stay as designed."
        actions={<a className={styles.button} href="/" target="_blank" rel="noreferrer">View homepage</a>}
      />
      <div className={styles.stack}>
        <HomepageContentEditor hero={content.hero} brandStory={content.brandStory} newsletter={content.newsletter} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>Lookbook</h2>
        <LookbookManager images={lookbook} />
      </div>
    </>
  );
}
