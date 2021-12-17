#!/bin/bash

rm -r fuseki

wget https://repo1.maven.org/maven2/org/apache/jena/apache-jena-fuseki/4.3.1/apache-jena-fuseki-4.3.1.zip \
&& unzip apache-jena-fuseki-4.3.1.zip \
&& rm apache-jena-fuseki-4.3.1.zip \
&& mv apache-jena-fuseki-4.3.1 fuseki
