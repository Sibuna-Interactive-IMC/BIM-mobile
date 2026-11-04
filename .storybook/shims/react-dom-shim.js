// Shim to ensure ReactDOM.unmountComponentAtNode exists in the client bundle.
// Works for React 18+ by using react-dom/client.createRoot().unmount() where available.
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

const defaultExport = (ReactDOM && ReactDOM.default) || ReactDOM;

if (!defaultExport.unmountComponentAtNode) {
    defaultExport.unmountComponentAtNode = function unmountComponentAtNode(container) {
        try {
            if (ReactDOMClient && typeof ReactDOMClient.createRoot === 'function') {
                // createRoot/unmount is safe to call to unmount the mounted tree
                const root = ReactDOMClient.createRoot(container);
                root.unmount();
                return true;
            }
        } catch (e) {
            // fall through to manual cleanup
        }
        // fallback: remove DOM children
        try {
            while (container.firstChild) container.removeChild(container.firstChild);
            return true;
        } catch (e) {
            return false;
        }
    };
}

export default defaultExport;
export * from 'react-dom';
