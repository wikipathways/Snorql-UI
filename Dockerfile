FROM httpd:2.4
 
ADD ./assets /usr/local/apache2/htdocs/assets/
COPY ./index.html /usr/local/apache2/htdocs/
 
ENV PATH /usr/local/apache2/bin:$PATH

# No VOLUME for htdocs: Docker Compose keeps an anonymous volume's contents when it
# recreates a container, which hides the files of a newer image (or of an instance image
# built FROM this one) behind the old ones. Nothing in htdocs needs to persist: script.sh
# rewrites config.js and index.html on every start.

EXPOSE 80 443

WORKDIR /app
 
COPY ./script.sh /app/script.sh

RUN chmod 755 /app/script.sh
RUN chmod +x /app/script.sh

COPY ./entrypoint.sh /app/entrypoint.sh

RUN chmod 755 /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
