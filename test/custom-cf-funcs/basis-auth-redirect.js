function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var authHeaders = request.headers.authorization;

    var regexes = [/\/talks\//, /\/post\//];

    if (regexes.some(regex => regex.test(request.uri))) {
        request.uri = request.uri.replace(/\/talks\//, '/works/');
        request.uri = request.uri.replace(/\/post\//, '/posts/');

        var response = {
            statusCode: 301,
            statusDescription: "Moved Permanently",
            headers:
                { "location": { "value": request.uri } }
        }
        return response;
    }

    var expected = "Basic cGV0ZXI6cGFu";

    if (authHeaders && authHeaders.value === expected) {
        if (uri.endsWith('/')) {
            request.uri += 'index.html';
        }
        else if (!uri.includes('.')) {
            request.uri += '/index.html';
        }
        return request;
    }

    var response = {
        statusCode: 401,
        statusDescription: "Unauthorized",
        headers: {
            "www-authenticate": {
                value: 'Basic realm="Enter credentials for this super secure site"',
            },
        },
    };

    return response;
} 