# Page Template Export/Import Guide

## Overview
The Page Template Export/Import feature allows super-admins to export page content as reusable JSON templates and import them to other pages. This is useful for:
- Copying page layouts between development and production environments
- Creating consistent page designs across multiple pages
- Backing up page content
- Sharing page templates with team members

## Features
- **Export**: Download page content (blocks and text) as a JSON file
- **Import**: Upload a JSON template to replace page content
- **Metadata Preservation**: Page metadata (name, slug, SEO) remains unchanged during import

## How to Use

### Exporting a Page Template

1. **Navigate to Pages Management**
   - Go to Dashboard → Admin → Pages

2. **Edit the Page You Want to Export**
   - Click "Edit" on any page in the list
   - You'll see an "Export Template" button in the top right

3. **Export the Template**
   - Click "Export Template"
   - A JSON file will be downloaded (e.g., `homepage-template.json`)
   - This file contains only the page blocks and content (no metadata)

### Importing a Template

#### Option 1: From Pages List
1. **Navigate to Pages Management**
   - Go to Dashboard → Admin → Pages

2. **Click the Upload Icon**
   - Each page row has an upload icon (📤) next to the Edit button
   - Click it to select a JSON template file

3. **Select Your Template File**
   - Choose the `.json` file you previously exported
   - The page content will be replaced immediately
   - Success message will appear

#### Option 2: From Page Editor
1. **Open the Page Editor**
   - Navigate to Dashboard → Admin → Pages
   - Click "Edit" on the page you want to update

2. **Import During Editing**
   - (Future enhancement: Add import button in editor)
   - For now, use the Pages List method

## What Gets Exported?
The exported JSON contains:
- `blocks`: Array of all content blocks (text, images, videos, etc.)
- `content`: Legacy content field

**Example:**
```json
{
  "blocks": [
    {
      "id": "block_123",
      "type": "text",
      "content": {"html": "<p>Hello World</p>"},
      "order": 0
    },
    {
      "id": "block_456",
      "type": "image",
      "content": {"url": "https://...", "alt": "Image"},
      "order": 1
    }
  ],
  "content": null
}
```

## What Gets Preserved During Import?
When you import a template, these page properties remain unchanged:
- Page name
- Slug (URL identifier)
- Path
- SEO settings (title, description, keywords, OG tags, etc.)
- Visibility status
- System page flag

Only the **blocks** and **content** are replaced.

## Use Cases

### 1. Development to Production
**Scenario**: You've built a perfect homepage layout in your development environment and want to deploy it to production.

**Steps**:
1. In development, go to the homepage editor
2. Click "Export Template"
3. Download `homepage-template.json`
4. In production, go to Pages Management
5. Click the upload icon next to the homepage
6. Select your `homepage-template.json` file
7. Done! Your production homepage now has the same design

### 2. Creating Consistent Page Layouts
**Scenario**: You want all your landing pages to have a similar structure.

**Steps**:
1. Design one perfect landing page
2. Export it as a template
3. Create new pages with different names/slugs
4. Import the template to each new page
5. Customize the text/images while keeping the layout

### 3. Backing Up Page Content
**Scenario**: You're about to make major changes and want a backup.

**Steps**:
1. Export your page template before editing
2. Make your changes
3. If something goes wrong, import the backup template

## Important Notes

⚠️ **Import Overwrites Content**
- Importing a template will completely replace all blocks on the target page
- This action cannot be undone (unless you have a backup)
- Always export a backup before importing if you want to preserve the original

✅ **Metadata is Safe**
- Your page name, URL, and SEO settings are never affected by imports
- Only the visual content blocks are replaced

🔒 **Super Admin Only**
- Only users with the "owner" role can export/import templates
- This prevents unauthorized page modifications

## API Endpoints

For developers who want to automate template management:

### Export Template
```bash
GET /api/admin/pages/{slug}/export
Authorization: Bearer {token}

Response:
{
  "blocks": [...],
  "content": "..."
}
```

### Import Template
```bash
POST /api/admin/pages/{slug}/import
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "blocks": [...],
  "content": "..."
}

Response: Updated page object
```

## Troubleshooting

### Error: "Please upload a JSON template file"
- Make sure you're selecting a `.json` file
- The file must be a valid JSON file exported from this system

### Error: "Invalid template file: missing blocks"
- The JSON file is missing the required `blocks` field
- Re-export the template or check your JSON structure

### Error: "Page not found"
- The target page doesn't exist
- Verify the page exists in Pages Management before importing

### Import Button Not Responding
- Check that you have super-admin access
- Refresh the page and try again
- Check browser console for errors

## Best Practices

1. **Always Export Before Major Changes**
   - Create a backup template before making significant edits
   - Store templates with descriptive names (e.g., `homepage-backup-2025-12-14.json`)

2. **Test in Development First**
   - Import templates to a test page first
   - Verify the layout looks correct before applying to production pages

3. **Document Your Templates**
   - Keep a library of templates with descriptions
   - Note which template is used for which type of page

4. **Version Control**
   - Store templates in version control (Git)
   - Track changes to templates over time

## Future Enhancements

Potential improvements for this feature:
- Import directly from the page editor
- Template library/marketplace
- Preview before import
- Partial imports (selected blocks only)
- Template versioning and history
- Share templates between workspaces
