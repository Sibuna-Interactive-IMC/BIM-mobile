// Minimal shim for @react-navigation/drawer used only in Storybook web preview.
export function useDrawerStatus() {
    // Return 'closed' by default. Stories can override by mocking if needed.
    return 'closed';
}

export default { useDrawerStatus };
