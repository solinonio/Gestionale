import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';


const Size = Quill.import('attributors/style/size') as any;
Size.whitelist = ['6pt', '8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '20pt'];
Quill.register(Size, true);

const Font = Quill.import('attributors/style/font') as any;
Font.whitelist = ['sans-serif', 'serif', 'monospace', 'arial', 'courier', 'tahoma', 'times', 'verdana'];
Quill.register(Font, true);

interface QuillEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function QuillEditor({ value, onChange }: QuillEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);

  useEffect(() => {
    if (editorRef.current && !quillInstance.current) {
      quillInstance.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'align': [] }],
            [{ 'font': ['sans-serif', 'serif', 'monospace', 'arial', 'courier', 'tahoma', 'times', 'verdana'] }],
            [{ 'size': ['6pt', '8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '20pt'] }],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
          ],
        },
      });

      quillInstance.current.on('text-change', () => {
        onChange(quillInstance.current?.root.innerHTML || '');
      });
    }
  }, [onChange]);

  useEffect(() => {
    if (quillInstance.current && value !== quillInstance.current.root.innerHTML) {
      quillInstance.current.root.innerHTML = value;
    }
  }, [value]);

  return <div ref={editorRef} />;
}
