import fitz

def delete_and_add_new_content(old_pdf, new_content_pdf, final_pdf):
    print("Step 1: Old PDF open...")
    doc = fitz.open(old_pdf)
    
    print("Step 2: Deleting all content...")
    for page_num in range(len(doc)):
        page = doc[page_num]
        text_boxes = page.get_text("words")
        for box in text_boxes:
            rect = fitz.Rect(box[0], box[1], box[2], box[3])
            page.add_redact_annot(rect)
        page.apply_redactions()
        page.draw_rect(page.rect, color=(1,1,1), fill=(1,1,1), width=0)
    
    print("Step 3: Opening new PDF...")
    new_doc = fitz.open(new_content_pdf)
    
    print("Step 4: Adding new content...")
    for i in range(min(len(doc), len(new_doc))):
        pix = new_doc[i].get_pixmap()
        doc[i].insert_image(doc[i].rect, pixmap=pix)
    
    print("Step 5: Saving...")
    doc.save(final_pdf)
    doc.close()
    new_doc.close()
    
    print(f"Done! Saved as: {final_pdf}")

# Change these file names to your actual files
delete_and_add_new_content("11k_book.pdf", "new_content.pdf", "final_output.pdf")