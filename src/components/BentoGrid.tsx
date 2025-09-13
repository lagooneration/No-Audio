import Link from 'next/link';
import '@/styles/BentoGrid.css';

const BentoGrid = () => {
  return (
    <div className="container-fluid bento-grid">
      <div className="row">
        <div className="col-lg-8 col-md-12">
          <div className="row">
            <div className="col-md-8">
              <Link href="/analysis" className="bento-item item-1">
                <h3>Analysis</h3>
                <p>In-depth audio file analysis.</p>
              </Link>
            </div>
            <div className="col-md-4">
              <Link href="/editing" className="bento-item item-2">
                <h3>Editing</h3>
                <p>Cut, trim, and modify your audio.</p>
              </Link>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
                <Link href="/beats" className="bento-item item-5">
                    <h3>Beats</h3>
                    <p>Create your own beats.</p>
                </Link>
            </div>
            <div className="col-md-8">
                <Link href="/chords" className="bento-item item-6">
                    <h3>Chords</h3>
                    <p>Generate chord progressions.</p>
                </Link>
            </div>
          </div>
        </div>
        <div className="col-lg-4 col-md-12">
          <Link href="/3d-sound-editor" className="bento-item item-3 full-height">
            <h3>3D Sound Editor</h3>
            <p>Experience audio in a 3D space.</p>
          </Link>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <Link href="/plugin-sound-matcher" className="bento-item item-4">
            <h3>Plugin Sound Matcher</h3>
            <p>Reverse engineer sound samples for audio plugin parameters.</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BentoGrid;
