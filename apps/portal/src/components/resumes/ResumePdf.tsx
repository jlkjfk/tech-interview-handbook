import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'react-pdf/node_modules/pdfjs-dist';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@heroicons/react/20/solid';
import { Button, Spinner } from '@tih/ui';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

type Props = Readonly<{
  url: string;
}>;

export default function ResumePdf({ url }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(750);
  const [componentWidth, setComponentWidth] = useState(780);

  const onPdfLoadSuccess = (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
  };

  useEffect(() => {
    const onPageResize = () => {
      setComponentWidth(
        document.querySelector('#pdfView')?.getBoundingClientRect().width ??
          780,
      );
    };

    window.addEventListener('resize', onPageResize);

    return () => {
      window.removeEventListener('resize', onPageResize);
    };
  }, []);

  return (
    <div id="pdfView">
      <div className="group relative">
        <Document
          className="flex h-[calc(100vh-17rem)] flex-row justify-center overflow-auto"
          file={url}
          loading={<Spinner display="block" size="lg" />}
          noData=""
          onLoadSuccess={onPdfLoadSuccess}>
          <div
            style={{
              paddingLeft: clsx(
                pageWidth > componentWidth
                  ? `${pageWidth - componentWidth}px`
                  : '',
              ),
            }}>
            <Page pageNumber={pageNumber} width={pageWidth} />
          </div>
          <div className="absolute top-2 right-5 hidden hover:block group-hover:block">
            <Button
              className="rounded-r-none focus:ring-0 focus:ring-offset-0"
              disabled={pageWidth === 450}
              icon={MagnifyingGlassMinusIcon}
              isLabelHidden={true}
              label="Zoom Out"
              variant="tertiary"
              onClick={() => setPageWidth(pageWidth - 150)}
            />
            <Button
              className="rounded-l-none focus:ring-0 focus:ring-offset-0"
              disabled={pageWidth === 1050}
              icon={MagnifyingGlassPlusIcon}
              isLabelHidden={true}
              label="Zoom In"
              variant="tertiary"
              onClick={() => setPageWidth(pageWidth + 150)}
            />
          </div>
        </Document>
      </div>

      <div className="flex flex-row items-center justify-between p-4">
        <Button
          disabled={pageNumber === 1}
          icon={ArrowLeftIcon}
          isLabelHidden={true}
          label="Previous"
          variant="tertiary"
          onClick={() => setPageNumber(pageNumber - 1)}
        />
        <p className="text-md text-gray-600">
          Page {pageNumber} of {numPages}
        </p>
        <Button
          disabled={pageNumber >= numPages}
          icon={ArrowRightIcon}
          isLabelHidden={true}
          label="Next"
          variant="tertiary"
          onClick={() => setPageNumber(pageNumber + 1)}
        />
      </div>
    </div>
  );
}
