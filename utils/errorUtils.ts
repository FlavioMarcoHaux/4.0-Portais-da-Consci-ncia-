// utils/errorUtils.ts

/**
 * Parses Gemini API errors and returns a user-friendly message.
 * @param error The error object from a catch block.
 * @param defaultMessage A fallback message.
 * @returns A user-friendly error string.
 */
export const getFriendlyErrorMessage = (error: any, defaultMessage: string): string => {
    console.error("Handling Gemini Error:", error);

    // 1. Handle Microphone/Device errors first (DOMException)
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
            return 'A permissão para usar o microfone foi negada. Por favor, verifique as permissões do seu navegador e do seu sistema operacional (Windows/macOS) e tente novamente.';
        }
        if (error.name === 'NotFoundError') {
            return 'Nenhum microfone foi encontrado. Por favor, conecte um microfone e tente novamente.';
        }
        // Other DOMExceptions can be handled here if needed
    }

    // 2. Extract string message from various other error formats
    let errorMessage = '';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error?.error?.message) {
        errorMessage = error.error.message;
    } else if (error && typeof error.toString === 'function') {
        errorMessage = error.toString();
    }

    // 3. Handle specific string-based errors
    
    // Network Error
    if (errorMessage.toLowerCase().includes('network error')) {
        return 'Erro de rede. Verifique sua conexão com a internet e tente novamente. Se o problema persistir, pode haver uma instabilidade no serviço.';
    }

    // Microphone permission denied by OS (not always a DOMException)
    if (errorMessage.includes('Permission denied by system')) {
         return 'A permissão para usar o microfone foi negada pelo sistema operacional. Verifique as configurações de privacidade do seu dispositivo (Windows/macOS) para permitir o acesso ao microfone pelo navegador.';
    }
    
    // API Quota
    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
        return 'Você excedeu sua cota de uso da API. Por favor, verifique seu plano e faturamento. Para mais detalhes, acesse: ai.google.dev/gemini-api/docs/billing';
    }

    // API Key issues
    if (errorMessage.includes("API key not found") || errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("Requested entity was not found")) {
        return "Sua chave de API não foi encontrada ou é inválida. Por favor, selecione uma chave de API válida para continuar.";
    }
    // `permission denied` is ambiguous, but in Gemini context without microphone mentions, it's likely the API key.
    if (errorMessage.includes("permission denied") && !errorMessage.toLowerCase().includes('microphone')) {
        return "Sua chave de API não foi encontrada ou é inválida. Por favor, selecione uma chave de API válida para continuar.";
    }
    
    // Bad Request
    if (errorMessage.includes("400") && (errorMessage.includes("Invalid") || errorMessage.includes("request is invalid"))){
        return `Ocorreu um erro de requisição inválida. Por favor, verifique os dados e tente novamente.`
    }

    // 4. Return default if no specific case matched
    return defaultMessage;
};